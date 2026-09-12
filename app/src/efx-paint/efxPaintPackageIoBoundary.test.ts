import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
 * The scan is static and comment-stripped (in the style of
 * `efxPaintCleanBreakContract.test.ts`): every plugin-fs identifier call is
 * attributed to its nearest preceding column-0 declaration, and that
 * declaration must be one of the MACHINE-CACHE functions, whose paths live
 * under the appdata cache root and are in the plugin's scope. A call anywhere
 * else fails with the enclosing function, the identifier and the line number —
 * so a reintroduced package-path call names itself.
 *
 * Positive pins keep the replacement honest: the three Rust-command wrappers
 * must be called from the persistence module, `removeStagingGeneration` may
 * occur exactly twice (declaration + cache leg), and the sibling package
 * modules stay off the plugin entirely.
 */

const APP_ROOT = resolve(__dirname, '../..');

const PERSISTENCE_FILE = resolve(APP_ROOT, 'src/lib/efxPaintPersistence.ts');
const PACKAGE_MODULE_FILE = resolve(APP_ROOT, 'src/lib/efxPaintPackage.ts');
const MEDIA_READ_MODULE_FILE = resolve(APP_ROOT, 'src/lib/efxPaintMediaRead.ts');

/** The identifiers the persistence module imports from the fs plugin. */
const PLUGIN_FS_IDENTIFIERS = ['exists', 'mkdir', 'readFile', 'remove', 'writeFile'] as const;

/**
 * The ONLY functions allowed to drive plugin-fs: the machine-local
 * derived-frame cache legs, rooted at `<app_data_dir>/frame-cache/<projectId>`
 * and therefore inside the granted appdata scope. A `.mce` package path never
 * reaches them.
 */
const MACHINE_CACHE_ALLOWLIST: ReadonlySet<string> = new Set([
  'ensureDir',
  'removeStagingGeneration',
  'stageFrame',
  'prepareEfxPaintCacheLeg',
  'settlePreparedEfxPaintCacheLeg',
]);

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

/** The `<token>(` call sites of one helper, with line and enclosing function. */
function callSites(scan: Scan, token: string): IdentifierCall[] {
  const pattern = new RegExp(`\\b${token}\\s*\\(`, 'g');
  const sites: IdentifierCall[] = [];
  for (let index = 0; index < scan.lines.length; index += 1) {
    if (pattern.test(scan.lines[index]) && scan.enclosing[index] !== token) {
      sites.push({ line: index + 1, identifier: token, enclosing: scan.enclosing[index] });
    }
  }
  return sites;
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

describe('package-IO boundary contract (quick-260913-05k)', () => {
  it('keeps every plugin-fs call inside a machine-cache function', () => {
    const scan = scanModule(PERSISTENCE_FILE);
    const violations = pluginFsCalls(scan, PLUGIN_FS_IDENTIFIERS).filter(
      (call) => !MACHINE_CACHE_ALLOWLIST.has(call.enclosing),
    );
    expect(
      violations.map(describeCall),
      'A renderer plugin-fs call on a .mce package path is forbidden (deletion checklist): '
        + 'package file IO must go through the Rust commands. Offending sites:',
    ).toEqual([]);
  });

  it('routes the package paths through the Rust command wrappers', () => {
    const source = readFileSync(PERSISTENCE_FILE, 'utf8');
    for (const wrapper of [
      'ipcEfxPaintWritePackageLayerFile(',
      'ipcEfxPaintReadPackageLayerFile(',
      'discardEfxPaintPackageStaging(',
    ]) {
      expect(source, `the persistence module must call ${wrapper}`).toContain(wrapper);
    }
  });

  it('removes the package-leg staging cleanup call', () => {
    const scan = scanModule(PERSISTENCE_FILE);
    const sites = callSites(scan, 'removeStagingGeneration');
    const violations = sites.filter((site) => !MACHINE_CACHE_ALLOWLIST.has(site.enclosing));
    expect(
      violations.map(describeCall),
      'removeStagingGeneration may only be called from the machine-cache legs; the package leg discards '
        + 'its staging generation through discardEfxPaintPackageStaging. Offending sites:',
    ).toEqual([]);
    expect(
      sites.length,
      `removeStagingGeneration must occur exactly twice (its declaration plus one machine-cache call); `
        + `found ${sites.length} call sites: ${sites.map(describeCall).join(', ')}`,
    ).toBe(2);
  });

  it('no longer imports readFile from the fs plugin', () => {
    expect(pluginFsImportNames(PERSISTENCE_FILE)).not.toContain('readFile');
  });

  it('keeps the sibling package modules off the fs plugin', () => {
    for (const path of [PACKAGE_MODULE_FILE, MEDIA_READ_MODULE_FILE]) {
      expect(pluginFsImportNames(path).length, `${path} must not import plugin-fs`).toBe(0);
    }
  });
});
