import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Pure source/text contract assertions for the Preact 11 JSX-namespace
// migration (RUN-04 / D-07). Preact 11 removed CSSProperties and the
// Targeted*Event types from the JSX namespace: those must be bare named type
// imports from 'preact'. JSX.Element stays in JSX — migrating it too is an
// over-migration regression (D-07). Source scan only — no DOM mount
// (releaseContract / paintVersion pin style).

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(APP_DIR, '..');

const D07_FILES = [
  {
    path: join(APP_DIR, 'src', 'components', 'shared', 'NumericStepper.tsx'),
    requiredTypeImports: ['CSSProperties', 'TargetedMouseEvent', 'TargetedPointerEvent'],
    keepsJsxElementReturn: true,
  },
  {
    path: join(APP_DIR, 'src', 'components', 'shared', 'SliderStepper.tsx'),
    requiredTypeImports: ['CSSProperties', 'TargetedMouseEvent', 'TargetedPointerEvent'],
    keepsJsxElementReturn: true,
  },
  {
    path: join(APP_DIR, 'src', 'components', 'physic-paint', 'engine', 'PhysicsPaintCanvasMount.tsx'),
    requiredTypeImports: ['CSSProperties'],
    keepsJsxElementReturn: false,
  },
] as const;

const SOURCE_ROOTS = [join(APP_DIR, 'src'), join(REPO_ROOT, 'packages')] as const;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage']);

// Anchored on word boundaries: a real type reference, not a prose mention inside
// a longer identifier. The forbidden literals are assembled from fragments so
// this pin's own source never trips the tree-wide scan it performs.
const FORBIDDEN_CSS_LABEL = 'JSX.' + 'CSSProperties';
const FORBIDDEN_EVENT_LABEL = 'JSX.' + 'Targeted';
const FORBIDDEN_JSX_REF = new RegExp(
  `\\b${FORBIDDEN_CSS_LABEL.replace('.', '\\.')}\\b|\\b${FORBIDDEN_EVENT_LABEL.replace('.', '\\.')}[A-Za-z]*\\b`,
  'g',
);

const EVENT_TYPE_NAMES = ['TargetedMouseEvent', 'TargetedPointerEvent'] as const;

const D07_SOURCES = D07_FILES.map((file) => ({
  ...file,
  source: readFileSync(file.path, 'utf8'),
}));

interface SourceHit {
  line: number;
  match: string;
}

/** Every forbidden JSX-namespace type reference, with its 1-based line number. */
function findForbiddenJsxRefs(source: string): SourceHit[] {
  const hits: SourceHit[] = [];
  const pattern = new RegExp(FORBIDDEN_JSX_REF.source, 'g');
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    hits.push({
      line: source.slice(0, index).split('\n').length,
      match: match[0],
    });
  }
  return hits;
}

interface PreactImportScan {
  /** Bare named specifiers imported as types (whole-statement `import type` or inline `type X`). */
  typeNames: Set<string>;
  /** Bare named specifiers imported as values. */
  valueNames: Set<string>;
  /** `import * as preact from 'preact'` — not a bare named type import. */
  hasNamespaceImport: boolean;
}

// `[^}]*` (not `[\s\S]*?`) keeps the named list inside one import statement —
// a lazy wildcard can swallow the `preact/hooks` line and match the NEXT
// manifest as if it belonged to this one.
const PREACT_IMPORT_PATTERN =
  /import\s+(type\s+)?(?:\*\s+as\s+[A-Za-z_$][\w$]*|\{([^}]*)\})\s+from\s+['"]preact['"]\s*;?/g;

function scanPreactImports(source: string): PreactImportScan {
  const typeNames = new Set<string>();
  const valueNames = new Set<string>();
  let hasNamespaceImport = false;

  for (const match of source.matchAll(PREACT_IMPORT_PATTERN)) {
    const statementIsTypeOnly = Boolean(match[1]);
    const namedList = match[2];
    if (namedList === undefined) {
      hasNamespaceImport = true;
      continue;
    }

    for (const rawSpecifier of namedList.split(',')) {
      let specifier = rawSpecifier.trim();
      if (!specifier) continue;

      let isTypeOnly = statementIsTypeOnly;
      if (/^type\s+/.test(specifier)) {
        isTypeOnly = true;
        specifier = specifier.replace(/^type\s+/, '').trim();
      }

      const importedName = specifier.split(/\s+as\s+/)[0]?.trim() ?? '';
      if (!importedName) continue;
      (isTypeOnly ? typeNames : valueNames).add(importedName);
    }
  }

  return { typeNames, valueNames, hasNamespaceImport };
}

function repoRelative(absPath: string): string {
  return relative(REPO_ROOT, absPath).split('\\').join('/');
}

/** Deterministic source walk of app/src and packages, skipping build/dependency output. */
function walkSourceFiles(root: string): string[] {
  const files: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        stack.push(join(current, entry.name));
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
        files.push(join(current, entry.name));
      }
    }
  }

  return files.sort((a, b) => repoRelative(a).localeCompare(repoRelative(b)));
}

describe('preact JSX namespace contract pin (RUN-04 / D-07)', () => {
  it('the three D-07 files contain no forbidden JSX-namespace type references', () => {
    for (const { path, source } of D07_SOURCES) {
      const hits = findForbiddenJsxRefs(source);
      expect(
        hits.map((hit) => `${repoRelative(path)}:${hit.line} ${hit.match}`),
        `${repoRelative(path)} must have zero ${FORBIDDEN_CSS_LABEL} / ${FORBIDDEN_EVENT_LABEL}* references (D-07: those types live in the preact namespace now)`,
      ).toEqual([]);
    }
  });

  it('the three D-07 files import CSSProperties and their used event types as bare named type imports from preact', () => {
    for (const { path, source, requiredTypeImports } of D07_SOURCES) {
      const relativePath = repoRelative(path);
      const scan = scanPreactImports(source);

      expect(
        scan.hasNamespaceImport,
        `${relativePath} must not use a preact namespace import; D-07 locks bare named type imports`,
      ).toBe(false);

      for (const requiredName of requiredTypeImports) {
        expect(
          scan.typeNames.has(requiredName),
          `${relativePath} must import type ${requiredName} from 'preact' as a bare named type import`,
        ).toBe(true);
      }

      // "where used": any bare event-type reference in the file must come from
      // the preact type import — never from the JSX namespace.
      for (const eventName of EVENT_TYPE_NAMES) {
        if (!new RegExp(`\\b${eventName}\\b`).test(source)) continue;
        expect(
          scan.typeNames.has(eventName),
          `${relativePath} uses ${eventName}; it must come from a bare named type import from 'preact'`,
        ).toBe(true);
      }
    }
  });

  it('NumericStepper.tsx and SliderStepper.tsx keep their JSX.Element return types (over-migration is a regression)', () => {
    const jsxElementReturn = /\):\s*JSX\.Element\s*\{/;

    for (const { path, source, keepsJsxElementReturn } of D07_SOURCES) {
      if (!keepsJsxElementReturn) continue;
      const relativePath = repoRelative(path);

      expect(
        source,
        `${relativePath} must keep its JSX.Element return type (D-07 keeps Element in the JSX namespace)`,
      ).toMatch(jsxElementReturn);
      expect(
        scanPreactImports(source).typeNames.has('JSX'),
        `${relativePath} must still import type JSX from 'preact' (for JSX.Element)`,
      ).toBe(true);
    }
  });

  it('the tree-wide scan covers app/src and packages, includes the three D-07 files, and skips build output', () => {
    const files = SOURCE_ROOTS.flatMap((root) => walkSourceFiles(root));
    const relativePaths = new Set(files.map(repoRelative));

    expect(
      files.length,
      'the tree-wide scan must read a non-empty source surface (not a vacuous pass)',
    ).toBeGreaterThan(100);
    for (const { path } of D07_FILES) {
      expect(relativePaths.has(repoRelative(path)), `scan must include ${repoRelative(path)}`).toBe(
        true,
      );
    }
    expect(
      [...relativePaths].some((path) => path.startsWith('app/src/')),
      'scan must include app/src',
    ).toBe(true);
    expect(
      [...relativePaths].some((path) => path.startsWith('packages/')),
      'scan must include packages',
    ).toBe(true);
    for (const path of relativePaths) {
      expect(path, `scan must skip node_modules (saw ${path})`).not.toContain('node_modules');
      expect(path, `scan must skip dist (saw ${path})`).not.toContain('/dist/');
      expect(path, `scan must skip coverage (saw ${path})`).not.toContain('/coverage/');
    }
  });

  it('no source file under app/src or packages uses the forbidden JSX-namespace type references', () => {
    const offenders: string[] = [];

    for (const root of SOURCE_ROOTS) {
      for (const file of walkSourceFiles(root)) {
        const source = readFileSync(file, 'utf8');
        for (const hit of findForbiddenJsxRefs(source)) {
          offenders.push(`${repoRelative(file)}:${hit.line} ${hit.match}`);
        }
      }
    }

    expect(
      offenders,
      `tree-wide scan of app/src + packages must find zero ${FORBIDDEN_CSS_LABEL} / ${FORBIDDEN_EVENT_LABEL}* references (D-07)`,
    ).toEqual([]);
  });

  it('the three D-07 files do not use the preact.JSX.* namespace form', () => {
    const preactJsxNamespace = /\bpreact\s*\.\s*JSX\s*\./;

    for (const { path, source } of D07_SOURCES) {
      expect(
        source,
        `${repoRelative(path)} must use bare named type imports, never the preact JSX namespace form (D-07)`,
      ).not.toMatch(preactJsxNamespace);
    }
  });

  it('the JSX-namespace scan leaves JSX.Element and the preact.JSX declaration legal', () => {
    const legalSource = [
      'declare namespace preact.JSX {',
      '  interface IntrinsicElements { div: unknown }',
      '}',
      'type Node = JSX.Element;',
    ].join('\n');

    expect(findForbiddenJsxRefs(legalSource)).toEqual([]);
  });

  it('the forbidden-reference scan actually detects a CSS-property or targeted-event namespace reference', () => {
    // Fragments keep this pin's own source clean for its tree-wide scan.
    const badCss = ['const style: ', FORBIDDEN_CSS_LABEL, ' = {};'].join('');
    const badEvent = ['type Handler = (event: ', FORBIDDEN_EVENT_LABEL, 'MouseEvent) => void;'].join('');

    expect(findForbiddenJsxRefs(badCss)).toHaveLength(1);
    expect(findForbiddenJsxRefs(badCss)[0].match).toBe(FORBIDDEN_CSS_LABEL);
    expect(findForbiddenJsxRefs(badEvent)).toHaveLength(1);
    expect(findForbiddenJsxRefs(badEvent)[0].match).toContain(FORBIDDEN_EVENT_LABEL);
  });

  it('the preact import scanner distinguishes bare named type imports from value, JSX-only, and namespace imports', () => {
    const bareType = scanPreactImports("import type { CSSProperties } from 'preact';");
    expect(bareType.typeNames.has('CSSProperties')).toBe(true);
    expect(bareType.hasNamespaceImport).toBe(false);

    const inlineType = scanPreactImports("import { type CSSProperties } from 'preact';");
    expect(inlineType.typeNames.has('CSSProperties')).toBe(true);

    const valueImport = scanPreactImports("import { CSSProperties } from 'preact';");
    expect(valueImport.typeNames.has('CSSProperties')).toBe(false);
    expect(valueImport.valueNames.has('CSSProperties')).toBe(true);

    const jsxOnly = scanPreactImports("import type { JSX } from 'preact';");
    expect(jsxOnly.typeNames.has('JSX')).toBe(true);
    expect(jsxOnly.typeNames.has('CSSProperties')).toBe(false);

    const namespaceImport = scanPreactImports("import type * as preact from 'preact';");
    expect(namespaceImport.hasNamespaceImport).toBe(true);
  });
});
