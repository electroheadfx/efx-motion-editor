/**
 * quick 261127-uxj: the dev-only brush-tip authoring converter — the 22 Wootha
 * PNGs on the artist's desktop into the app's bundled `wc/default-*` mask
 * assets.
 *
 * WHY THIS IS NOT SHIPPED CODE
 * The source PNGs never enter the repo. This file lives outside `app/src`, is
 * wired into no build step, no `app/package.json` script and no Tauri bundle
 * resource (the `scripts/mce-package-rescue.ts` precedent). It is run once, by
 * hand, in a terminal, whenever the bundled tip set is authored or amended.
 *
 * WHAT IT DOES
 *   1. discovers the source `*.png` files (non-recursive) under `--src`;
 *   2. derives each slug: basename minus `.png`, every `.abr-` replaced by `-`
 *      (`wootha.abr-002.png` → `wootha-002`);
 *   3. converts each PNG through the REAL engine law — ImageMagick to exactly
 *      512×512 8-bit RGBA, then the package's own `deriveMask` (never a fork,
 *      never `normalizeMaskContrast`). The sources carry alpha, so `deriveMask`
 *      takes its ALPHA branch and the mask IS the ink coverage — do NOT
 *      flatten, do NOT composite on white: flattening would destroy the mask;
 *   4. orders the tips by SLUG (plain lexicographic string sort — never the
 *      source filename, whose `-` < `.` ordering inverts the ends);
 *   5. writes `<slug>.mask` (exactly 262,144 bytes each, the engine's
 *      `TIP_MASK_BYTES`) plus `manifest.json`
 *      (`{ "tips": [{ id, name, file }] }`, 2-space JSON, trailing newline).
 *
 * Ids live in the bundled APP ASSET namespace `wc/default-<slug>` — distinct
 * from the machine library's `wc/custom-*` rows, so bundled tips never enter
 * `customBrushTips`, the cross-realm payload or the script carrier, and can
 * never collide with a user import.
 *
 * ALL OR NOTHING: every tip converts in memory first; one unreadable source,
 * one failed conversion, one wrong-length RGBA payload or one all-zero mask
 * aborts the run with a non-zero exit and writes nothing.
 *
 * DETERMINISTIC: no timestamps, no absolute paths — the same inputs produce
 * byte-identical outputs.
 *
 * Usage: node scripts/build-brush-tips.ts --src <directory> [--out <directory>] [--magick <binary>]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  TIP_MASK_BYTES,
  deriveMask,
} from '../packages/efx-watercolor/src/brushes/deriveMask.ts';

const DEFAULT_OUT = 'app/src/assets/brush-tips';
const DEFAULT_MAGICK = 'magick';

const USAGE = [
  'build-brush-tips — convert the bundled Wootha PNGs into app mask assets.',
  '',
  'Usage:',
  '  node scripts/build-brush-tips.ts --src <directory> [--out <directory>] [--magick <binary>]',
  '',
  '  --src     the directory holding the source *.png tips (non-recursive)',
  `  --out     the asset directory to write (default: ${DEFAULT_OUT})`,
  `  --magick  the ImageMagick binary (default: ${DEFAULT_MAGICK})`,
  '  --help    this text',
  '',
  'All or nothing: one failed conversion writes nothing. Only <slug>.mask and',
  'manifest.json are written; the source PNGs stay where they are.',
].join('\n');

interface BuildArgs {
  readonly sourceDir: string;
  readonly outputDir: string;
  readonly magick: string;
}

interface ConvertedTip {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly mask: Uint8Array;
}

/** Slug law: basename minus `.png`, every `.abr-` replaced by `-`. */
function slugForFile(fileName: string): string {
  return fileName.replace(/\.png$/i, '').replaceAll('.abr-', '-');
}

/**
 * Name law: the slug's words title-cased, the final numeric segment
 * zero-padded to 3 digits (`wootha-002` → "Wootha 002",
 * `wootha-charcoal-001` → "Wootha Charcoal 001").
 */
function nameForSlug(slug: string): string {
  const words = slug.split('-');
  return words
    .map((word, index) => {
      if (index === words.length - 1 && /^\d+$/.test(word)) return word.padStart(3, '0');
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function parseArgs(argv: readonly string[]): BuildArgs | null {
  let sourceDir: string | null = null;
  let outputDir = DEFAULT_OUT;
  let magick = DEFAULT_MAGICK;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = (): string => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      index += 1;
      return value;
    };
    if (arg === '--help' || arg === '-h') return null;
    else if (arg === '--src') sourceDir = next();
    else if (arg === '--out') outputDir = next();
    else if (arg === '--magick') magick = next();
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (sourceDir === null) throw new Error('--src is required');
  return { sourceDir: resolve(sourceDir), outputDir: resolve(outputDir), magick };
}

/** Discover the source PNGs (non-recursive), name-sorted for stable logs. */
function discoverSources(sourceDir: string): string[] {
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`source directory not found: ${sourceDir}`);
  }
  const files = readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => entry.name)
    .sort();
  if (files.length === 0) throw new Error(`no PNG files in ${sourceDir}`);
  return files;
}

/**
 * Convert ONE source through the real law: ImageMagick → exactly 512×512
 * RGBA, then the package's `deriveMask`. Fails closed on any length or
 * degeneracy, never silently substituting a partial mask.
 */
function convertOne(sourcePath: string, magick: string): Uint8Array {
  // Node's execFileSync maxBuffer default is exactly the RGBA payload size —
  // leave headroom rather than depending on the boundary.
  const rgba = execFileSync(
    magick,
    [sourcePath, '-filter', 'Lanczos', '-resize', '512x512!', '-depth', '8', 'rgba:-'],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  if (rgba.length !== TIP_MASK_BYTES * 4) {
    throw new Error(
      `${sourcePath}: expected ${TIP_MASK_BYTES * 4} RGBA bytes, got ${rgba.length}`,
    );
  }
  const mask = deriveMask(new Uint8Array(rgba));
  if (mask === null) throw new Error(`${sourcePath}: deriveMask refused the payload`);
  if (mask.length !== TIP_MASK_BYTES) {
    throw new Error(`${sourcePath}: expected a ${TIP_MASK_BYTES}-byte mask, got ${mask.length}`);
  }
  let hasInk = false;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 0) {
      hasInk = true;
      break;
    }
  }
  if (!hasInk) throw new Error(`${sourcePath}: the derived mask is all zero (no ink)`);
  return mask;
}

function main(): void {
  let args: BuildArgs | null;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`build-brush-tips: ${(error as Error).message}\n`);
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  if (args === null) {
    console.log(USAGE);
    return;
  }

  try {
    const sources = discoverSources(args.sourceDir);
    // Slug order is the manifest law: a plain lexicographic sort on the slug,
    // never on the source filename — `wootha-charcoal.abr-001.png` sorts first
    // under filename order (`-` < `.`), which is the wrong end.
    const entries = sources
      .map((fileName) => {
        const slug = slugForFile(fileName);
        return {
          sourcePath: join(args.sourceDir, fileName),
          id: `wc/default-${slug}`,
          name: nameForSlug(slug),
          file: `${slug}.mask`,
          slug,
        };
      })
      .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

    // All or nothing: convert every tip in memory before touching the disk.
    const converted: ConvertedTip[] = entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      file: entry.file,
      mask: convertOne(entry.sourcePath, args.magick),
    }));

    mkdirSync(args.outputDir, { recursive: true });
    // Keep the output directory exactly the bundled set: a stale `.mask` from
    // a previous authoring run would otherwise ride the app's glob.
    const keep = new Set(converted.map((tip) => tip.file));
    for (const existing of readdirSync(args.outputDir)) {
      if (existing.endsWith('.mask') && !keep.has(existing)) {
        rmSync(join(args.outputDir, existing));
      }
    }
    for (const tip of converted) {
      writeFileSync(join(args.outputDir, tip.file), tip.mask);
    }
    const manifest = {
      tips: converted.map((tip) => ({ id: tip.id, name: tip.name, file: tip.file })),
    };
    writeFileSync(
      join(args.outputDir, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    console.log(
      `build-brush-tips: wrote ${converted.length} masks + manifest.json to ${args.outputDir}`,
    );
    console.log(`  first: ${converted[0]!.id} "${converted[0]!.name}"`);
    console.log(`  last:  ${converted[converted.length - 1]!.id} "${converted[converted.length - 1]!.name}"`);
  } catch (error) {
    // Conversion failures abort before the first write; a write-phase failure
    // can leave partial output, so never claim a clean rollback.
    console.error(`build-brush-tips: ${(error as Error).message}`);
    console.error('build-brush-tips: aborted');
    process.exitCode = 1;
  }
}

main();
