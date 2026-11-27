/**
 * quick 261116-inu / Task 10 — the retired texture ids stay dead.
 *
 * quick 261116-inu removed every compile-time brush texture: import is the
 * only way to obtain one, and a texture id is always a machine-library
 * `wc/custom-<hex>` row. Old fixtures kept naming the retired built-in ids
 * long after the production code stopped seeding them — the prefix survived
 * as test data that no longer described anything real.
 *
 * This is the boundary scan that keeps the retirement total: every source
 * file in the app, the watercolor package and the Rust crate is read, and
 * none may contain the retired prefix. The prefix is BUILT at runtime
 * (`['wc/', 'builtin-'].join('')`) so this file never matches itself.
 *
 * quick 261127-uxj — the 22 bundled Wootha tips do NOT reopen this: they are a
 * different concept, read-only APP ASSETS loaded at boot under the
 * `wc/default-*` id namespace (never machine-library rows, never in
 * `customBrushTips` or the cross-realm payload). The retired compile-time
 * texture ids stay forbidden, this scan's roots and literal stay unchanged,
 * and the bundled namespace is what keeps both laws strict.
 *
 * No whitelist and no skip list: a name that needs the old prefix belongs to
 * a deleted concept, not to an exception. A failure names the file and line,
 * so a miss is a lookup, not a hunt.
 *
 * Paths are relative to the app suite's cwd (`app/`): `app/src` would resolve
 * to `app/app/src` and the walk would pass vacuously, so each root asserts
 * that it actually found scan candidates.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The app root — this file lives in `app/src/lib/`. */
const APP_ROOT = resolve(__dirname, '../..');

/** Built at runtime so this file cannot match itself. */
const RETIRED_PREFIX = ['wc/', 'builtin-'].join('');

/** Scanned roots, relative to `APP_ROOT`. */
const ROOTS = ['src', '../packages/efx-watercolor/src', 'src-tauri/src'] as const;

const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.rs'] as const;

/** Directories that hold generated output, never authored source. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'target', '.git']);

function walk(directory: string, out: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      walk(join(directory, entry.name), out);
      continue;
    }
    if (entry.isFile() && SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      out.push(join(directory, entry.name));
    }
  }
  return out;
}

describe('retired texture ids stay dead (quick 261116-inu)', () => {
  it('no app, package or Rust source names the retired prefix', () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      const absoluteRoot = resolve(APP_ROOT, root);
      const files = walk(absoluteRoot);
      expect(files.length, `the scan root ${root} must not be empty`).toBeGreaterThan(0);
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        if (!content.includes(RETIRED_PREFIX)) continue;
        content.split('\n').forEach((line, index) => {
          if (!line.includes(RETIRED_PREFIX)) return;
          hits.push(`${relative(APP_ROOT, file)}:${index + 1}: ${line.trim()}`);
        });
      }
    }
    expect(hits, 'retired built-in texture ids belong to a deleted concept').toEqual([]);
  });
});
