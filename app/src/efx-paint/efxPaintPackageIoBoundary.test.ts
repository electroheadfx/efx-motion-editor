import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * quick-260913-05k: the fail-closed package-IO boundary contract.
 *
 * The live P0 this file closes: `efxPaintPersistence.ts` drove `@tauri-apps/plugin-fs`
 * on `.mce` package paths (staging-root `mkdir`, layer `writeFile`, the load
 * leg's `exists`/`readFile`), and the capability grants only
 * `fs:scope-appdata-recursive` — so every save carrying changes failed with
 * `forbidden path: …/.efx-paint-package-staging-<uuid>` while the plan suites
 * stayed green over an in-memory package that never drove the permission
 * layer. Package file IO now goes through app-defined Rust commands, which
 * carry no capability scope.
 *
 * UAT row 1 (2026-09-13) refuted the second half of that reading: the
 * machine-cache legs were NOT safely in scope. The live build refused
 * `allow-mkdir` on `<app_data_dir>/frame-cache/<projectId>/.efx-paint-staging-<uuid>`
 * with the same scope error, and the rejection failed the whole save (a D-14
 * violation, fixed in the same quick). The persistence module now drives NO
 * plugin-fs call at all — package AND cache file operations are app-defined
 * commands — so the module scan is allowlist-free: any plugin-fs call it
 * finds fails.
 *
 * The scan is static and comment-stripped (in the style of
 * `efxPaintCleanBreakContract.test.ts`): every plugin-fs identifier call is
 * attributed to its nearest preceding column-0 declaration and reported with
 * the enclosing function, the identifier and the line number. A second scan
 * fails any source module that references the fs plugin specifier AND a
 * machine-cache token — the two must never meet in one file. Static scope
 * reading has missed twice; these scans pin the class.
 *
 * Positive pins keep the replacement honest: the Rust-command wrappers (three
 * package, four cache) must be called from the persistence module, the
 * plugin-fs staging helpers are gone outright, and the sibling package
 * modules stay off the plugin entirely.
 */

const APP_ROOT = resolve(__dirname, '../..');

const PERSISTENCE_FILE = resolve(APP_ROOT, 'src/lib/efxPaintPersistence.ts');
const PACKAGE_MODULE_FILE = resolve(APP_ROOT, 'src/lib/efxPaintPackage.ts');
const MEDIA_READ_MODULE_FILE = resolve(APP_ROOT, 'src/lib/efxPaintMediaRead.ts');

/** The identifiers the persistence module imports from the fs plugin. */
const PLUGIN_FS_IDENTIFIERS = ['exists', 'mkdir', 'readFile', 'remove', 'writeFile'] as const;

/**
 * The machine-cache root's spellings (D-05). A module that references any of
 * these while also referencing the fs plugin specifier is a boundary
 * violation: cache paths were refused live exactly like package paths.
 */
const MACHINE_CACHE_TOKENS = ['frame-cache', '.efx-paint-staging-', 'MACHINE_CACHE_DIR'] as const;

interface Scan {
  /** Comment-stripped source lines, 1:1 with the file's lines. */
  readonly lines: readonly string[];
  /** The nearest preceding column-0 declaration name for each line index. */
  readonly enclosing: readonly string[];
}

/**
 * Stateful comment stripper: removes `//` line comments and `/* … *​/` block
 * comments (multi-line state tracked) while preserving string literals, so a
 * `//` inside a string is not mistaken for a comment and prose cannot
 * self-invalidate the scan.
 */
function stripComments(source: string): string[] {
  let inBlockComment = false;
  return source.split('\n').map((line) => {
    let out = '';
    let index = 0;
    let inString: "'" | '"' | '`' | null = null;
    while (index < line.length) {
      const character = line[index];
      const next = line[index + 1];
      if (inBlockComment) {
        if (character === '*' && next === '/') {
          inBlockComment = false;
          index += 2;
        } else {
          index += 1;
        }
        continue;
      }
      if (inString !== null) {
        out += character;
        if (character === '\\' && next !== undefined) {
          out += next;
          index += 2;
          continue;
        }
        if (character === inString) inString = null;
        index += 1;
        continue;
      }
      if (character === '/' && next === '*') {
        inBlockComment = true;
        index += 2;
        continue;
      }
      if (character === '/' && next === '/') break;
      if (character === "'" || character === '"' || character === '`') {
        inString = character;
        out += character;
        index += 1;
        continue;
      }
      out += character;
      index += 1;
    }
    return out;
  });
}

/** The declaration a column-0 line opens, or null when it opens none. */
function declarationName(line: string): string | null {
  const functionMatch = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*[<(]/.exec(line);
  if (functionMatch) return functionMatch[1];
  const constMatch = /^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::[^=]*)?=\s*/.exec(line);
  if (constMatch) return constMatch[1];
  return null;
}

function scanModule(path: string): Scan {
  const lines = stripComments(readFileSync(path, 'utf8'));
  const enclosing: string[] = [];
  let current: string | null = null;
  let inBlockComment = false;
  for (const line of lines) {
    // A declaration line is only a boundary outside a block comment; the
    // stripper already blanked comment bodies, so an empty line implies none.
    if (line.trim().length > 0 && !inBlockComment) {
      const name = declarationName(line);
      if (name !== null) current = name;
    }
    enclosing.push(current ?? '<module>');
    if (line.trim().length === 0 && inBlockComment) inBlockComment = false;
  }
  return { lines, enclosing };
}

interface IdentifierCall {
  readonly line: number;
  readonly identifier: string;
  readonly enclosing: string;
}

/** Every `<identifier>(` call of the fs plugin identifiers, with its line. */
function pluginFsCalls(scan: Scan, identifiers: readonly string[]): IdentifierCall[] {
  const pattern = new RegExp(`\\b(${identifiers.join('|')})\\s*\\(`, 'g');
  const calls: IdentifierCall[] = [];
  for (let index = 0; index < scan.lines.length; index += 1) {
    const matches = scan.lines[index].matchAll(pattern);
    for (const match of matches) {
      calls.push({
        line: index + 1,
        identifier: match[1],
        enclosing: scan.enclosing[index],
      });
    }
  }
  return calls;
}

function describeCall(call: IdentifierCall): string {
  return `${call.enclosing}():${call.line} -> ${call.identifier}()`;
}

/** Every line carrying the bare token, declaration included. */
function occurrenceLines(scan: Scan, token: string): number[] {
  const pattern = new RegExp(`\\b${token}\\b`, 'g');
  const lines: number[] = [];
  for (let index = 0; index < scan.lines.length; index += 1) {
    if (pattern.test(scan.lines[index])) lines.push(index + 1);
  }
  return lines;
}

/** The names one module imports from the fs plugin (empty when it imports none). */
function pluginFsImportNames(path: string): string[] {
  const source = stripComments(readFileSync(path, 'utf8')).join('\n');
  const match = /import\s*\{([^}]*)\}\s*from\s*'@tauri-apps\/plugin-fs'/.exec(source);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/** Every non-test `.ts`/`.tsx` module under `app/src`, recursively. */
function appSourceModules(): string[] {
  const modules: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) continue;
      modules.push(path);
    }
  };
  walk(join(APP_ROOT, 'src'));
  return modules;
}

describe('package + cache IO boundary contract (quick-260913-05k)', () => {
  it('keeps the persistence module off the fs plugin entirely', () => {
    const scan = scanModule(PERSISTENCE_FILE);
    const violations = pluginFsCalls(scan, PLUGIN_FS_IDENTIFIERS);
    expect(
      violations.map(describeCall),
      'No renderer plugin-fs call may remain in the persistence module: package AND machine-cache '
        + 'file IO goes through the Rust commands — the appdata scope was refused live on both '
        + '(forbidden path …/.efx-paint-package-staging-<uuid>, then …/.efx-paint-staging-<uuid>). '
        + 'Offending sites:',
    ).toEqual([]);
  });

  it('routes the package and cache paths through the Rust command wrappers', () => {
    const source = readFileSync(PERSISTENCE_FILE, 'utf8');
    for (const wrapper of [
      'ipcEfxPaintWritePackageLayerFile(',
      'ipcEfxPaintReadPackageLayerFile(',
      'discardEfxPaintPackageStaging(',
      'preparePhysicPaintCacheGeneration(',
      'stagePhysicPaintCacheFrame(',
      'discardPhysicPaintCacheStaging(',
      'removePhysicPaintCacheEntry(',
    ]) {
      expect(source, `the persistence module must call ${wrapper}`).toContain(wrapper);
    }
  });

  it('deletes the plugin-fs staging helpers outright', () => {
    const scan = scanModule(PERSISTENCE_FILE);
    // The cache legs' plugin-fs helpers: nothing may reintroduce them, under
    // their old names or as call sites.
    expect(occurrenceLines(scan, 'removeStagingGeneration')).toEqual([]);
    expect(occurrenceLines(scan, 'ensureDir')).toEqual([]);
  });

  it('drops the fs-plugin import entirely', () => {
    expect(pluginFsImportNames(PERSISTENCE_FILE)).toEqual([]);
  });

  it('never mixes the fs plugin with a machine-cache path in one module', () => {
    const violations: string[] = [];
    for (const path of appSourceModules()) {
      const source = stripComments(readFileSync(path, 'utf8')).join('\n');
      if (!source.includes('@tauri-apps/plugin-fs')) continue;
      const tokens = MACHINE_CACHE_TOKENS.filter((token) => source.includes(token));
      if (tokens.length > 0) {
        violations.push(`${relative(APP_ROOT, path)} (${tokens.join(', ')})`);
      }
    }
    expect(
      violations,
      'A module referencing the fs plugin must not touch machine-cache paths: the plugin scope '
        + 'refused them live (`allow-mkdir` on <.efx-paint-staging-*>) and the rejection failed a '
        + 'save (D-14). Cache IO goes through the prepare/stage/discard/remove app commands. '
        + 'Offending modules:',
    ).toEqual([]);
  });

  it('keeps the sibling package modules off the fs plugin', () => {
    for (const path of [PACKAGE_MODULE_FILE, MEDIA_READ_MODULE_FILE]) {
      expect(pluginFsImportNames(path).length, `${path} must not import plugin-fs`).toBe(0);
    }
  });
});
