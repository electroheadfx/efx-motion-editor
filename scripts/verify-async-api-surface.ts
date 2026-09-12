/**
 * 52.2-13 Task 4 (D-17): the installed-surface API drift gate.
 *
 * WHY THIS EXISTS
 * `SPECS/async-conventions.md` is the contract plans 14/15 code against. Its
 * API names were authored from research-time sources, and the pilot's own
 * guidance sources lag the installed packages (the effect-ts skill's upstream
 * is `effect@4.0.0-beta.92`, older than the pinned `4.0.0-rc.115`). A name
 * that is wrong in the document becomes wrong code in plan 14, so the
 * document's names are checked against the declaration files actually shipped
 * in `app/node_modules` -- the installed tree is the source of truth, never
 * the registry payload and never the research notes.
 *
 * WHAT IT CHECKS
 *   1. every import binding in the document's fenced code examples
 *      (`import { ... } from 'xstate' | 'effect'`, `import type { ... }`,
 *      `import * as X from ...`, `x as y` aliases included) must resolve in
 *      that package's entry declaration export list; each is printed with the
 *      declaration file it is re-exported from;
 *   2. the names the document cites as available but the pilot does not
 *      import (`CITED_NOT_IMPORTED`) must also resolve;
 *   3. the creators the document records as REMOVED (`CITED_AS_REMOVED`) must
 *      stay absent from the entry export lists -- the mirror assertion;
 *   4. the dotted members and option shapes the document cites
 *      (`MEMBER_CHECKS`) must appear in the declaration file that declares
 *      their owner.
 * A document with no extractable import bindings is a failure, not a pass: the
 * binding list is what this gate checks, so the examples must carry explicit
 * import lines.
 *
 * This is a read-only audit. It writes nothing, imports neither library, and
 * is wired into no build step.
 *
 * Usage:
 *   node scripts/verify-async-api-surface.ts [doc-path]
 *   (default doc-path: SPECS/async-conventions.md)
 * Exits non-zero when any name is missing, any removed name is exported, any
 * cited member is absent, or the document yields no import bindings.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_DOC = join(REPO_ROOT, 'SPECS', 'async-conventions.md');
const APP_NODE_MODULES = join(REPO_ROOT, 'app', 'node_modules');

/** Per package: the package dir, the entry declaration, and the dir it lives in. */
const PACKAGES = {
  xstate: {
    dir: join(APP_NODE_MODULES, 'xstate'),
    entry: 'dist/declarations/src/index.d.ts',
    entryRoot: 'dist/declarations/src',
  },
  effect: {
    dir: join(APP_NODE_MODULES, 'effect'),
    entry: 'dist/index.d.ts',
    entryRoot: 'dist',
  },
} as const;

type PackageName = keyof typeof PACKAGES;

/**
 * Names the document cites as available (the §2 facts table, the pilot
 * section) that the pilot's import block does not itself import. Checked for
 * the same reason: the document asserts they exist.
 */
const CITED_NOT_IMPORTED: readonly { pkg: PackageName; name: string; note: string }[] = [
  { pkg: 'xstate', name: 'createMachine', note: 'the plain (non-setup) machine builder' },
  { pkg: 'xstate', name: 'createCallbackLogic', note: 'fromCallback replacement' },
  { pkg: 'xstate', name: 'createObservableLogic', note: 'fromObservable replacement' },
  { pkg: 'xstate', name: 'createLogic', note: 'fromTransition replacement' },
  { pkg: 'xstate', name: 'transition', note: 'hand-written actor logic transition(...)' },
  { pkg: 'xstate', name: 'initialTransition', note: 'hand-written actor logic initialTransition(...)' },
  { pkg: 'xstate', name: 'getInitialSnapshot', note: 'snapshot-only reads (6.0.0-alpha.4 note)' },
];

/**
 * The action/guard creators the document records as removed in v6. The
 * document's claim is their ABSENCE; that claim is checked here, so a
 * re-introduced creator cannot silently re-enter the conventions doc as
 * "available".
 */
const CITED_AS_REMOVED: readonly string[] = [
  'assign',
  'raise',
  'sendTo',
  'sendParent',
  'forwardTo',
  'emit',
  'log',
  'cancel',
  'spawnChild',
  'stop',
  'stopChild',
  'enqueueActions',
  'and',
  'or',
  'not',
  'stateIn',
  'interpret',
  'Interpreter',
  'fromPromise',
  'fromCallback',
  'fromObservable',
  'fromTransition',
];

/**
 * Dotted members and option shapes the document cites. `member` must appear
 * as a declaration or property in `file` (the file that declares its owner),
 * matched by a name followed by `:`, `(`, `<` or `?` so prose mentions do not
 * satisfy the check.
 */
const MEMBER_CHECKS: readonly { pkg: PackageName; file: string; member: string; note: string }[] = [
  { pkg: 'xstate', file: 'dist/declarations/src/setup.d.ts', member: 'createMachine', note: 'setup(...).createMachine' },
  { pkg: 'xstate', file: 'dist/declarations/src/setup.d.ts', member: 'schemas', note: 'setup schemas option (root + per-state refinement)' },
  { pkg: 'xstate', file: 'dist/declarations/src/actors/logic.d.ts', member: 'run', note: 'createAsyncLogic({ run })' },
  { pkg: 'xstate', file: 'dist/declarations/src/createActor.d.ts', member: 'select', note: 'actor.select(s => ...) — change-only Readable' },
  { pkg: 'xstate', file: 'dist/declarations/src/createActor.d.ts', member: 'subscribe', note: 'actor.subscribe(...) — Subscription' },
  { pkg: 'xstate', file: 'dist/declarations/src/createActor.d.ts', member: 'trigger', note: 'actor.trigger.* commands' },
  { pkg: 'xstate', file: 'dist/declarations/src/createActor.d.ts', member: 'start', note: 'actor.start()' },
  { pkg: 'xstate', file: 'dist/declarations/src/createActor.d.ts', member: 'stop', note: 'actor.stop()' },
  { pkg: 'xstate', file: 'dist/declarations/src/State.d.ts', member: 'matches', note: 'snapshot.matches(...)' },
  { pkg: 'xstate', file: 'dist/declarations/src/types.v6.d.ts', member: 'onError', note: 'invoking state onError' },
  { pkg: 'effect', file: 'dist/Effect.d.ts', member: 'gen', note: 'Effect.gen' },
  { pkg: 'effect', file: 'dist/Queue.d.ts', member: 'bounded', note: 'Queue.bounded(capacity)' },
  { pkg: 'effect', file: 'dist/Fiber.d.ts', member: 'interrupt', note: 'Fiber.interrupt(fiber)' },
];

/** One import binding extracted from the document. */
interface Binding {
  readonly pkg: PackageName;
  readonly local: string;
  readonly imported: string;
  readonly line: number;
}

/** The entry declaration's export surface, parsed from its index.d.ts. */
interface ExportIndex {
  /** Exported name -> module specifier it is re-exported from. */
  readonly named: Map<string, string>;
  /** Namespace name -> module specifier (`export * as X from ...`). */
  readonly namespaces: Map<string, string>;
  /** Wildcard targets (`export type * from ...`) searched as a fallback. */
  readonly wildcards: readonly string[];
}

const NAMED_IMPORT = /^\s*import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/;
const NAMESPACE_IMPORT = /^\s*import\s+(?:type\s+)?\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

/** The package version, read from the installed package.json. */
function installedVersion(pkg: PackageName): string {
  const manifest = JSON.parse(readText(join(PACKAGES[pkg].dir, 'package.json'))) as { version?: unknown };
  if (typeof manifest.version !== 'string') throw new Error(`${pkg}: package.json carries no version`);
  return manifest.version;
}

/** Turn a re-export specifier into the declaration file it resolves to. */
function resolveDeclarationFile(pkg: PackageName, specifier: string): string {
  const base = PACKAGES[pkg].entryRoot;
  return join(base, specifier.replace(/^\.\//, '').replace(/\.(js|mjs|cjs|ts)$/, '.d.ts'));
}

/** Strip block comments so a jsdoc-riddled export list parses as a name list. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Blank out block comments while preserving newlines, so declaration matching
 * never fires on prose that happens to contain a name (`function or observer`).
 */
function blankComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/** Exported names in one `export { ... } from "..."` list, aliases resolved to the exported side. */
function namedExportsIn(list: string): string[] {
  return stripComments(list)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.replace(/^type\s+/, '').trim())
    .map((entry) => {
      const parts = entry.split(/\s+as\s+/);
      return (parts.length > 1 ? parts[parts.length - 1] : entry).trim();
    })
    .filter((entry) => /^[A-Za-z_$][\w$]*$/.test(entry));
}

function parseExportIndex(pkg: PackageName): ExportIndex {
  const text = readText(join(PACKAGES[pkg].dir, PACKAGES[pkg].entry));
  const named = new Map<string, string>();
  const namespaces = new Map<string, string>();
  const wildcards: string[] = [];

  for (const match of text.matchAll(/export\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const name of namedExportsIn(match[1])) named.set(name, match[2]);
  }
  for (const match of text.matchAll(/export\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s*from\s*['"]([^'"]+)['"]/g)) {
    namespaces.set(match[1], match[2]);
  }
  for (const match of text.matchAll(/export\s+type\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    wildcards.push(match[1]);
  }
  return { named, namespaces, wildcards };
}

/**
 * Resolve one exported name to its declaration file, or undefined when absent.
 * A namespace export is a valid named import too (`import { Effect } from
 * 'effect'`), so the namespace map is consulted alongside the named one.
 */
function locate(pkg: PackageName, name: string, index: ExportIndex): string | undefined {
  const source = index.named.get(name) ?? index.namespaces.get(name);
  if (source !== undefined) return resolveDeclarationFile(pkg, source);
  for (const wildcard of index.wildcards) {
    const file = resolveDeclarationFile(pkg, wildcard);
    const path = join(PACKAGES[pkg].dir, file);
    if (!existsSync(path)) continue;
    const text = blankComments(readText(path));
    const declaration = new RegExp(`(^|\\n)\\s*(export\\s+)?(declare\\s+)?(const|function|class|interface|type|namespace|enum)\\s+${name}\\b`);
    if (declaration.test(text)) return file;
  }
  return undefined;
}

/**
 * Declared member inside its owner's declaration file, with the first matching
 * line. Block comments are blanked out first (newlines preserved): a member
 * name that only appears in a jsdoc example is not a declaration.
 */
function locateMember(pkg: PackageName, file: string, member: string): number | undefined {
  const path = join(PACKAGES[pkg].dir, file);
  if (!existsSync(path)) return undefined;
  const text = readText(path).replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const lines = text.split('\n');
  const pattern = new RegExp(`\\b${member}\\b\\s*[:(<?]`);
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i])) return i + 1;
  }
  return undefined;
}

/** Every import binding the document's examples carry for the two packages. */
function extractBindings(doc: string): { bindings: Binding[]; importLines: number } {
  const bindings: Binding[] = [];
  let importLines = 0;
  const lines = doc.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const named = NAMED_IMPORT.exec(lines[i]);
    if (named !== null) {
      const pkg = named[2] === 'xstate' || named[2] === 'effect' ? (named[2] as PackageName) : undefined;
      if (pkg === undefined) continue;
      importLines += 1;
      for (const entry of named[1].split(',')) {
        const trimmed = entry.replace(/^type\s+/, '').trim();
        if (trimmed.length === 0) continue;
        const parts = trimmed.split(/\s+as\s+/);
        const imported = parts[0].trim();
        const local = (parts.length > 1 ? parts[1] : parts[0]).trim();
        if (!/^[A-Za-z_$][\w$]*$/.test(imported)) {
          throw new Error(`doc line ${i + 1}: cannot read import binding "${entry.trim()}"`);
        }
        bindings.push({ pkg, local, imported, line: i + 1 });
      }
      continue;
    }
    const namespace = NAMESPACE_IMPORT.exec(lines[i]);
    if (namespace !== null) {
      const pkg = namespace[2] === 'xstate' || namespace[2] === 'effect' ? (namespace[2] as PackageName) : undefined;
      if (pkg === undefined) continue;
      importLines += 1;
      bindings.push({ pkg, local: namespace[1], imported: `* as ${namespace[1]}`, line: i + 1 });
    }
  }
  return { bindings, importLines };
}

function main(): number {
  const docPath = resolve(process.argv[2] ?? DEFAULT_DOC);
  const failures: string[] = [];

  if (!existsSync(docPath) || !statSync(docPath).isFile()) {
    console.error(`verify-async-api-surface: doc not found: ${docPath}`);
    return 1;
  }
  for (const [pkg, config] of Object.entries(PACKAGES) as [PackageName, (typeof PACKAGES)[PackageName]][]) {
    if (!existsSync(join(config.dir, config.entry))) {
      console.error(`verify-async-api-surface: ${pkg} entry declaration not found under ${config.dir} -- is the pinned install in place?`);
      return 1;
    }
  }

  console.log('verify-async-api-surface');
  console.log(`  doc      ${docPath}`);
  for (const pkg of Object.keys(PACKAGES) as PackageName[]) {
    console.log(`  ${pkg.padEnd(8)} ${installedVersion(pkg)}  (${PACKAGES[pkg].dir})`);
  }

  const { bindings, importLines } = extractBindings(readText(docPath));
  console.log('');
  console.log(`import bindings (${importLines} import line(s), ${bindings.length} name(s)):`);
  if (bindings.length === 0) {
    failures.push(
      'the document carries no extractable import bindings -- its examples need explicit '
      + "`import { ... } from 'xstate' / 'effect'` lines for this gate to check",
    );
  }
  const indexes = new Map<PackageName, ExportIndex>();
  for (const pkg of Object.keys(PACKAGES) as PackageName[]) indexes.set(pkg, parseExportIndex(pkg));

  for (const binding of bindings) {
    const index = indexes.get(binding.pkg) as ExportIndex;
    if (binding.imported.startsWith('* as ')) {
      const source = index.namespaces.get(binding.local);
      if (source === undefined) {
        failures.push(`line ${binding.line}: ${binding.pkg} has no namespace export "${binding.local}"`);
        console.log(`  MISSING  ${binding.pkg.padEnd(7)} ${binding.imported}`);
      } else {
        console.log(`  ok       ${binding.pkg.padEnd(7)} ${binding.imported}  ->  ${resolveDeclarationFile(binding.pkg, source)}`);
      }
      continue;
    }
    const file = locate(binding.pkg, binding.imported, index);
    const alias = binding.local === binding.imported ? '' : ` (imported as ${binding.local})`;
    if (file === undefined) {
      failures.push(`line ${binding.line}: ${binding.pkg} does not export "${binding.imported}"${alias}`);
      console.log(`  MISSING  ${binding.pkg.padEnd(7)} ${binding.imported}${alias}`);
    } else {
      console.log(`  ok       ${binding.pkg.padEnd(7)} ${binding.imported}${alias}  ->  ${file}`);
    }
  }

  console.log('');
  console.log('cited, not imported:');
  for (const check of CITED_NOT_IMPORTED) {
    const file = locate(check.pkg, check.name, indexes.get(check.pkg) as ExportIndex);
    if (file === undefined) {
      failures.push(`${check.pkg} does not export "${check.name}" (${check.note})`);
      console.log(`  MISSING  ${check.pkg.padEnd(7)} ${check.name}`);
    } else {
      console.log(`  ok       ${check.pkg.padEnd(7)} ${check.name}  ->  ${file}  (${check.note})`);
    }
  }

  console.log('');
  console.log('removed creators (must stay absent):');
  for (const name of CITED_AS_REMOVED) {
    const present = locate('xstate', name, indexes.get('xstate') as ExportIndex);
    if (present !== undefined) {
      failures.push(`xstate exports "${name}" again -- the document records it as removed (${present})`);
      console.log(`  PRESENT  xstate  ${name}  ->  ${present}`);
    } else {
      console.log(`  ok       xstate  ${name}  absent`);
    }
  }

  console.log('');
  console.log('dotted members / option shapes:');
  for (const check of MEMBER_CHECKS) {
    const line = locateMember(check.pkg, check.file, check.member);
    if (line === undefined) {
      failures.push(`${check.pkg}/${check.file} declares no member "${check.member}" (${check.note})`);
      console.log(`  MISSING  ${check.pkg.padEnd(7)} ${check.file}  ${check.member}`);
    } else {
      console.log(`  ok       ${check.pkg.padEnd(7)} ${check.file}:${line}  ${check.member}  (${check.note})`);
    }
  }

  console.log('');
  if (failures.length > 0) {
    for (const failure of failures) console.log(`FAILED   ${failure}`);
    console.log('');
    console.log(`  ${failures.length} unresolved name(s) -- the document names API surface the installed packages do not ship.`);
    return 1;
  }
  console.log(`  ALL CHECKS PASSED -- every name the document cites resolves in the installed .d.ts surface.`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`verify-async-api-surface: ${messageOf(error)}`);
  process.exitCode = 1;
}
